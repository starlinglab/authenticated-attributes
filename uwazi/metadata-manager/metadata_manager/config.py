import os

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
ENTITY_DATA = os.environ["ENTITY_DATA"]
