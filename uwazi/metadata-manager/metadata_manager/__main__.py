import requests
import time
import logging


from .entity import Entity, EntityError, load_entity_data, save_entity_data
from .config import LOGLEVEL, UWAZI_SERVER, USERNAME, PASSWORD, ENTITY_DATA
from .template import Template

# Seconds to delay in loops
LOOP_DELAY = 5
ERROR_DELAY = 30


logging.basicConfig(format="%(asctime)s - %(levelname)s - %(message)s", level=LOGLEVEL)
# Prevent requests debug logging
logging.getLogger("requests").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

session = requests.Session()

# Map of template IDs to Template instances
templates = {}


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


def load_templates():
    global templates

    r = session.get(
        f"{UWAZI_SERVER}/api/templates",
        headers={
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        timeout=10,
    )
    if not r.ok:
        logging.error(
            "failed to get templates: error %d",
            r.status_code,
        )
        return

    items = r.json()["rows"]
    logging.debug("search retrieved %d templates", len(items))

    templates = {}
    for item in items:
        templates[item["_id"]] = Template(item)


def valid_entities():
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
            ent = Entity(item, templates, session)
        except EntityError as err:
            logging.debug('skipping due to error with "%s": %s', item.get("title"), err)
            continue
        yield ent


def main():
    login()
    logging.info("started and logged in to Uwazi")

    load_entity_data(ENTITY_DATA)

    while True:
        load_templates()
        logging.debug("loaded templates")

        for entity in valid_entities():
            logging.debug("starting on %s", entity)

            if not entity.cid:
                entity.set_cid()

            entity.metadata_hyperbee_sync()

        save_entity_data(ENTITY_DATA)
        time.sleep(LOOP_DELAY)
        # Prevents error: requests.exceptions.ConnectionError: ('Connection aborted.', RemoteDisconnected('Remote end closed connection without response'))
        session.close()
        login_if_needed()
        # With login ensured, move on to the next CID check


while True:
    try:
        main()
    except Exception:  # pylint: disable=broad-exception-caught
        save_entity_data(ENTITY_DATA)
        logging.exception(
            "unexpected exception was raised, waiting 30 secs then restarting"
        )

    time.sleep(ERROR_DELAY)
