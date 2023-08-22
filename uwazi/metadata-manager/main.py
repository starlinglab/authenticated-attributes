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


class Entity:
    def __init__(self, data: dict) -> None:
        self.data = data
        self.filename = self._get_filename()
        self.filepath = os.path.join(UWAZI_ROOT, "uploaded_documents", self.filename)
        self.cid = self._get_cid()

    def __repr__(self) -> str:
        return f"Entity(filename={self.filename})"

    def _get_filename(self) -> str:
        if len(self.data["documents"]) == 0:
            # Must have an attachment instead
            return self.data["attachments"][0]["filename"]
        # Document (PDF)
        return self.data["documents"][0]["filename"]

    def get_metadata(self) -> dict:
        """
        Returns the entity's metadata as a simple dictionary.

        The CID metadata field is not included.
        """

        # "metadata" field in self.data contains what we need
        # metadata': {'test_metadata': [{'value': 'foo'}], 'sha256cid': [{'value': 'bafkreicq4s4oweux2bkwsuktmjyl4gagx3englpwd7fa6uvsv3mvokzgzy'}]}

        ret = {}
        for field, values in self.data["metadata"].items():
            if field == CID_METADATA_NAME:
                continue
            if len(values) == 0 or "value" not in values[0]:
                continue
            ret[field] = values[0]["value"]

        return ret

    def metadata_hyperbee_sync(self):
        """
        Upload metadata to hyperbee database.

        CID must be set already.

        Metadata is not actually sent if it matches what was sent last time.
        """

        metadata = self.get_metadata()
        if not metadata:
            # Empty, skip
            return

        encoded_metadata = dag_cbor.encode(metadata)
        meta_hash = sha256(encoded_metadata).digest()
        if entity_metadata.get(self.cid) == meta_hash:
            # Don't re-upload
            logging.debug("skipping metadata upload for %s", self)
            return

        # Don't share session with Uwazi server
        r = requests.post(
            f"{AUTHATTR_SERVER}/{self.cid}",
            headers={"Authorization": "Bearer " + AUTHATTR_JWT},
            data=encoded_metadata,
            timeout=10,
        )
        if r.status_code != 200:
            logging.error(
                "failed to POST uwazi metadata to hyperbee: error %d", r.status_code
            )
            return

        # Success, record it
        entity_metadata[self.cid] = meta_hash
        logging.debug("successful metadata upload for %s", self)

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
        if not r.ok:
            logging.error(
                "failed to set CID for entity '%s': error %d",
                self.filename,
                r.status_code,
            )


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

    for item in r.json()["rows"]:
        # if (
        #     len(item["metadata"].get(CID_METADATA_NAME, [])) > 0
        #     and len(item["metadata"][CID_METADATA_NAME][0]["value"]) > 0
        # ):
        #     # Has CID
        #     continue
        if len(item["documents"]) + len(item["attachments"]) != 1:
            # Multi-file or no files
            continue

        yield Entity(item)


def main():
    login()
    logging.info("started and logged in to Uwazi")

    while True:
        for entity in entities_with_file():
            if not entity.cid:
                entity.set_cid()
                logging.info("set CID for %s", entity)

            entity.metadata_hyperbee_sync()
            logging.info("synced metadata to hyperbee for %s", entity)

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
