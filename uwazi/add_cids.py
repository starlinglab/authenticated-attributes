import os
import requests
import json
import subprocess
import time

from dotenv import load_dotenv

load_dotenv()

UWAZI_ROOT = os.environ["UWAZI_ROOT"]
CID_METADATA_NAME = os.getenv("CID_METADATA_NAME", "sha256cid")
USERNAME = os.environ["USERNAME"]
PASSWORD = os.environ["PASSWORD"]

SERVER = os.environ["SERVER"]

session = requests.Session()


class Entity:
    def __init__(self, data: dict) -> None:
        self.data = data
        self.filename = self._get_filename()
        self.filepath = os.path.join(UWAZI_ROOT, "uploaded_documents", self.filename)

    def __repr__(self) -> str:
        return f"Entity(filename={self.filename})"

    def _get_filename(self) -> str:
        if len(self.data["documents"]) == 0:
            # Must have an attachment instead
            return self.data["attachments"][0]["filename"]
        # Document (PDF)
        return self.data["documents"][0]["filename"]

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
        return proc.stdout.strip()

    def set_cid(self) -> None:
        self.data["metadata"][CID_METADATA_NAME] = [{"value": self._calc_cid()}]
        r = session.post(
            f"{SERVER}/api/entities",
            headers={
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            files={"entity": ("", json.dumps(self.data))},
            timeout=10,
        )
        if r.status_code == 422:
            # No CID field in this entity's template
            return
        r.raise_for_status()


def login():
    r = session.post(
        f"{SERVER}/api/login",
        headers={"Accept": "application/json"},
        json={"username": USERNAME, "password": PASSWORD},
        timeout=10,
    )
    r.raise_for_status()

    # Now login cookie is stored in session


def login_if_needed():
    r = session.get(
        f"{SERVER}/api/",
        headers={"Accept": "application/json", "X-Requested-With": "XMLHttpRequest"},
        timeout=10,
    )
    if r.status_code == 401:
        login()


def entities_without_cid():
    r = session.get(
        f"{SERVER}/api/search",
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
    r.raise_for_status()

    for item in r.json()["rows"]:
        if (
            len(item["metadata"].get(CID_METADATA_NAME, [])) > 0
            and len(item["metadata"][CID_METADATA_NAME][0]["value"]) > 0
        ):
            # Has CID
            continue
        if len(item["attachments"]) == 0:
            # No files
            continue

        # Check that there is only one attached file, minus preview files
        # https://github.com/starlinglab/authenticated-attributes/issues/43
        num_attachments = len(item["attachments"])
        for attachment in item["attachments"]:
            if attachment["originalname"] == "preview" or attachment[
                "originalname"
            ].startswith("preview."):
                num_attachments -= 1

        if num_attachments != 1:
            # There is more than one non-preview attachment
            continue

        yield Entity(item)


def main():
    login()

    while True:
        for entity in entities_without_cid():
            entity.set_cid()

        time.sleep(5)
        # Prevents error: requests.exceptions.ConnectionError: ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
        session.close()
        login_if_needed()
        # With login ensured, move on to the next CID check


if __name__ == "__main__":
    main()
