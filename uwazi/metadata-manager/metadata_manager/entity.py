import os
import requests
import json
import subprocess
import logging
from typing import Optional
from collections import defaultdict
import pickle

import dag_cbor

from .config import (
    UWAZI_ROOT,
    CID_METADATA_NAME,
    AUTHATTR_SERVER,
    AUTHATTR_JWT,
    UWAZI_SERVER,
)
from .template import Template


class EntityError(Exception):
    pass


class Entity:
    """Uwazi Entity"""

    # Track what metadata was last sent to the hyperbee server, to prevent needless writes
    # Maps entity CID to metadata object, "metadata"
    entity_metadata = defaultdict(dict)

    # Track when entities were last edited, to skip processing metadata early
    # Maps entity CID to Unix millis timestamp from Uwazi "editDate".
    entity_edit_dates = defaultdict(int)

    def __init__(
        self, data: dict, templates: dict[str, Template], session=None
    ) -> None:
        self.data = data
        self.session = session
        if not self.session:
            self.session = requests.Session()

        if not self._has_valid_files():
            raise EntityError("invalid files")

        self.filename = self._get_filename()
        self.filepath = os.path.join(UWAZI_ROOT, "uploaded_documents", self.filename)
        self.cid = self._get_cid()

        if self.data["template"] not in templates:
            raise EntityError("missing template")
        self.template = templates[self.data["template"]]

        if not self.template.has(CID_METADATA_NAME):
            raise EntityError("doesn't support CID")

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

    def _get_authattr_metadata(self, data) -> list:
        """
        Returns the entity's metadata as a format an Authenticated Attributes server will accept.

        The metadata is given in the `data` param, not taken from the instance to allow
        a subset of metadata to be provided.

        Relationships are not supported, everything else should be.
        """

        # See the POST to /:cid function in server.js for an example of what format
        # is being conformed to here.
        ret = []

        for field, values in data.items():
            entry = self.template.encode_authattr(field, values)
            if entry is not None:
                ret.append(entry)

        return ret

    def metadata_hyperbee_sync(self, indexing=True):
        """
        Upload metadata to hyperbee database.

        CID must be set already.

        Metadata is not actually sent if it matches what was sent last time.
        """

        metadata = self.data.get("metadata")
        if not metadata:
            # Empty, skip
            logging.debug("no sync due to empty metadata for %s", self)
            return

        if Entity.entity_edit_dates[self.cid] >= self.data["editDate"]:
            # Hasn't been edited since last upload
            logging.debug("skipping meta upload due to editDate for %s", self)
            return

        # Check which metadata items have changed and encode those

        changed_metadata = {}  # subset with same shape as metadata

        for field, values in self.data["metadata"].items():
            if field == CID_METADATA_NAME:
                continue
            if Entity.entity_metadata[self.cid].get(field) != values:
                # Has changed
                changed_metadata[field] = values

        aa_metadata = self._get_authattr_metadata(changed_metadata)

        # Manually handle Uwazi title, not in metadata object
        if Entity.entity_metadata[self.cid].get("title") != self.data["title"]:
            aa_metadata.append(
                {"key": "title", "value": self.data["title"], "type": "str"}
            )

        # Don't share session with Uwazi server
        params = {"index": "1"} if indexing else {}
        r = requests.post(
            f"{AUTHATTR_SERVER}/c/{self.cid}",
            headers={"Authorization": "Bearer " + AUTHATTR_JWT},
            data=dag_cbor.encode(aa_metadata),
            params=params,
            timeout=10,
        )
        if r.status_code != 200:
            logging.error(
                "failed to POST uwazi metadata to hyperbee: error %d", r.status_code
            )
            return

        # Success, update global records
        Entity.entity_edit_dates[self.cid] = self.data["editDate"]
        for field, values in changed_metadata.items():
            Entity.entity_metadata[self.cid][field] = values
        Entity.entity_metadata[self.cid]["title"] = self.data["title"]

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
        r = self.session.post(
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
            # This shouldn't happen normally, as the template is checked in the constructor
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


def load_entity_data(path):
    if not os.path.exists(path):
        logging.warning("skipping entity data loading, file not found: %s", path)
        return

    with open(path, "rb") as f:
        data = pickle.load(f)
    Entity.entity_metadata = data["entity_metadata"]
    Entity.entity_edit_dates = data["entity_edit_dates"]
    logging.info("loaded entity data from %s", path)


def save_entity_data(path):
    data = {
        "entity_metadata": Entity.entity_metadata,
        "entity_edit_dates": Entity.entity_edit_dates,
    }
    with open(path, "wb") as f:
        pickle.dump(data, f)
    logging.debug("saved entity data to %s", path)
