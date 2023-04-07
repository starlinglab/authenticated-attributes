import os
import requests
import json
import subprocess

UWAZI_ROOT = "/home/makeworld/uwazi"
CID_METADATA_NAME = "sha256cid"
USERNAME = "admin"
PASSWORD = "change this password now"

SERVER = "http://localhost:3000"

session = requests.Session()


class Entity:
    def __init__(self, data: dict) -> None:
        self.filename = data["documents"][0]["filename"]
        self.data = data
        self.filepath = os.path.join(UWAZI_ROOT, "uploaded_documents", self.filename)

    def __repr__(self) -> str:
        return f"Entity(filename={self.filename})"

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
        r.raise_for_status()


def login():
    r = session.post(
        f"{SERVER}/api/login",
        headers={"Accept": "application/json"},
        json={"username": USERNAME, "password": PASSWORD},
    )
    r.raise_for_status()

    # Now login cookie is stored in session


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
            print("Has CID, skipping")
            continue
        if len(item["documents"]) > 1:
            # Has more than one document, not allowed
            print("Multi-document, skipping")
            continue

        yield Entity(item)


def main():
    login()
    for entity in entities_without_cid():
        entity.set_cid()


if __name__ == "__main__":
    main()
