import requests
import time
import logging


from .entity import Entity, EntityError
from .config import LOGLEVEL, UWAZI_SERVER, USERNAME, PASSWORD

# Seconds to delay in loops
LOOP_DELAY = 5
ERROR_DELAY = 30


logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=LOGLEVEL)
# Prevent requests debug logging
logging.getLogger("requests").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

session = requests.Session()


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
            ent = Entity(item, session)
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

        time.sleep(LOOP_DELAY)
        # Prevents error: requests.exceptions.ConnectionError: ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
        session.close()
        login_if_needed()
        # With login ensured, move on to the next CID check


while True:
    try:
        main()
    except Exception:  # pylint: disable=broad-exception-caught
        logging.exception(
            "unexpected exception was raised, waiting 30 secs then restarting"
        )

    time.sleep(ERROR_DELAY)
