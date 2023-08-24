import os
import requests
import json
import subprocess
import time
import logging
from typing import Optional
from hashlib import sha256

import dag_cbor
from dotenv import load_dotenv

load_dotenv()

UWAZI_ROOT = os.environ["UWAZI_ROOT"]
CID_METADATA_NAME = os.getenv("CID_METADATA_NAME", "sha256cid")
USERNAME = os.environ["USERNAME"]
PASSWORD = os.environ["PASSWORD"]
UWAZI_SERVER = os.environ["UWAZI_SERVER"]
AUTHATTR_SERVER = os.environ["AUTHATTR_SERVER"]
AUTHATTR_JWT = os.environ["AUTHATTR_JWT"]
LOGLEVEL = os.getenv("LOGLEVEL", "INFO")


logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=LOGLEVEL)
# Prevent requests debug logging
logging.getLogger("requests").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

session = requests.Session()

# Track what metadata was last sent to the hyperbee server, to prevent needless writes
# Maps entity CID to SHA-256 hash of DAG-CBOR metadata sent to hyperbee server
entity_metadata = {}


class EntityError(Exception):
    pass


class Entity:
    def __init__(self, data: dict) -> None:
        self.data = data

        if not self._has_valid_files():
            raise EntityError("invalid files")

        self.filename = self._get_filename()
        self.filepath = os.path.join(UWAZI_ROOT, "uploaded_documents", self.filename)
        self.cid = self._get_cid()

    def __repr__(self) -> str:
        return f"Entity(title={self.data.get('title')})"

    def _has_valid_files(self) -> bool:
        """
        Valid files for creating a CID and displaying the AA UI.
        """

        if len(self.data["documents"]) > 0:
            return False

        # Check that there is only one attached file, minus preview files
        # https://github.com/starlinglab/authenticated-attributes/issues/43

        num_attachments = len(self.data["attachments"])

        if num_attachments == 0:
            # Fast path for no attachments
            return False

        for attachment in self.data["attachments"]:
            if attachment["originalname"] == "preview" or attachment[
                "originalname"
            ].startswith("preview."):
                num_attachments -= 1

        if num_attachments != 1:
            # There is no single non-preview attachment
            return False

        return True

    def _get_filename(self) -> str:
        # Find the one attachment that's not a preview file
        for attachment in self.data["attachments"]:
            if attachment["originalname"] != "preview" and not attachment[
                "originalname"
            ].startswith("preview."):
                return attachment["filename"]

    def _get_authattr_metadata(self) -> dict:
        """
        Returns the entity's metadata as a format an Authenticated Attributes server will accept.

        The CID metadata field is not included.

        Metadata with multiple values are skipped as they can't be indexed.
        Multi-value metadata types can't be identified ahead of time so this can
        result in metadata for a multi-value type being returned when it only has
        one value set so far.

        Metadata with more than just a "value" key are also skipped. This is for
        types like Select, or relationships.
        """

        # "metadata" field in self.data contains what we need
        # metadata': {'test_metadata': [{'value': 'foo'}], 'sha256cid': [{'value': 'bafkreicq4s4oweux2bkwsuktmjyl4gagx3englpwd7fa6uvsv3mvokzgzy'}]}

        # See the POST to /:cid function in server.js for an example of what format
        # is being conformed to here.
        ret = []

        for field, values in self.data["metadata"].items():
            if field == CID_METADATA_NAME:
                continue
            if len(values) != 1 or "value" not in values[0] or len(values[0]) != 1:
                continue

            # TODO: detect dates somehow? Right now they are encoded as float64

            real_val = values[0]["value"]
            if type(real_val) in (int, float):
                # Uwazi doesn't have separate int or float metadata types
                # So float64 is used as a catch-all
                index_type = "float64"
            elif type(real_val) is str:
                index_type = "str"
            else:
                # Can't be indexed
                index_type = None

            ret.append({"key": field, "value": real_val, "type": index_type})

        return ret

    def metadata_hyperbee_sync(self, indexing=True):
        """
        Upload metadata to hyperbee database.

        CID must be set already.

        Metadata is not actually sent if it matches what was sent last time.
        """

        metadata = self._get_authattr_metadata()
        if not metadata:
            # Empty, skip
            logging.debug("no sync due to empty metadata for %s", self)
            return

        encoded_metadata = dag_cbor.encode(metadata)
        meta_hash = sha256(encoded_metadata).digest()
        if entity_metadata.get(self.cid) == meta_hash:
            # Don't re-upload
            logging.debug("skipping metadata upload for %s", self)
            return

        # Don't share session with Uwazi server
        params = {"index": "1"} if indexing else {}
        r = requests.post(
            f"{AUTHATTR_SERVER}/{self.cid}",
            headers={"Authorization": "Bearer " + AUTHATTR_JWT},
            data=encoded_metadata,
            params=params,
            timeout=10,
        )
        if r.status_code != 200:
            logging.error(
                "failed to POST uwazi metadata to hyperbee: error %d", r.status_code
            )
            return

        # Success, record it
        entity_metadata[self.cid] = meta_hash
        logging.info("successful metadata upload for %s", self)

    def _calc_cid(self) -> str:
        proc = subprocess.run(
            [
                "ipfs",
                "add",
                "--only-hash=true",
                "--wrap-with-directory=false",
                "--cid-version=1",
                "--hash=sha2-256",
                "--pin=true",
                "--raw-leaves=true",
                "--chunker=size-262144",
                "--nocopy=false",
                "--fscache=false",
                "--inline=false",
                "--inline-limit=32",
                "--quieter",
                self.filepath,
            ],
            capture_output=True,
            check=True,
            text=True,
        )
        self.cid = proc.stdout.strip()
        return self.cid

    def _get_cid(self) -> Optional[str]:
        if CID_METADATA_NAME in self.data["metadata"]:
            return self.data["metadata"][CID_METADATA_NAME][0]["value"]
        return None

    def set_cid(self) -> None:
        self.data["metadata"][CID_METADATA_NAME] = [{"value": self._calc_cid()}]
        r = session.post(
            f"{UWAZI_SERVER}/api/entities",
            headers={
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            files={"entity": ("", json.dumps(self.data))},
            timeout=10,
        )
        if r.status_code == 422:
            # "Unprocessable Entity" error
            # Means that the CID field is not supported for this entity, it's not in the template
            # Further work is needed, see https://github.com/starlinglab/authenticated-attributes/issues/44
            logging.warning("setting CID not supported by template: %s", self)
            return
        if not r.ok:
            logging.error(
                "failed to set CID for %s: error %d",
                self,
                r.status_code,
            )
            return

        logging.info("set CID for %s", self)


def login():
    r = session.post(
        f"{UWAZI_SERVER}/api/login",
        headers={"Accept": "application/json"},
        json={"username": USERNAME, "password": PASSWORD},
        timeout=10,
    )
    if not r.ok:
        logging.error(
            "failed to login to Uwazi: error %d",
            r.status_code,
        )

    # Now login cookie is stored in session


def login_if_needed():
    r = session.get(
        f"{UWAZI_SERVER}/api/",
        headers={"Accept": "application/json", "X-Requested-With": "XMLHttpRequest"},
        timeout=10,
    )
    if r.status_code == 401:
        login()


def entities_with_file():
    r = session.get(
        f"{UWAZI_SERVER}/api/search",
        params={
            "includeUnpublished": "true",
            "order": "desc",
            "sort": "creationDate",
            "aggregatePublishingStatus": "true",
            "aggregatePermissionsByUsers": "true",
            "include": '["permissions"]',
        },
        headers={
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        timeout=10,
    )
    if not r.ok:
        logging.error(
            "failed to get entities: error %d",
            r.status_code,
        )
        return

    items = r.json()["rows"]
    logging.debug("search retrieved %d entities", len(items))

    for item in items:
        try:
            ent = Entity(item)
        except EntityError:
            logging.debug(
                "skipping due to invalid files: entity with title: %s",
                item.get("title"),
            )
            continue
        yield ent


def main():
    login()
    logging.info("started and logged in to Uwazi")

    while True:
        for entity in entities_with_file():
            logging.debug("starting on %s", entity)

            if not entity.cid:
                entity.set_cid()

            entity.metadata_hyperbee_sync()

        time.sleep(5)
        # Prevents error: requests.exceptions.ConnectionError: ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
        session.close()
        login_if_needed()
        # With login ensured, move on to the next CID check


if __name__ == "__main__":
    while True:
        try:
            main()
        except Exception:  # pylint: disable=broad-exception-caught
            logging.exception(
                "unexpected exception was raised, waiting 30 secs then restarting"
            )

        time.sleep(30)
