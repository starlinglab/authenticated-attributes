from typing import Optional
import logging


class Template:
    """Uwazi template"""

    def __init__(self, data: dict) -> None:
        self.data = data
        self.id = self.data["_id"]

    def __repr__(self) -> str:
        return f"Template(name={self.data.get('name')})"

    def has(self, name: str) -> bool:
        for prop in self.data["properties"]:
            if prop["name"] == name:
                return True
        return False

    def get(self, name: str) -> Optional[dict]:
        for prop in self.data["properties"]:
            if prop["name"] == name:
                return prop
        return None

    def encode_authattr(self, name: str, values) -> Optional[dict]:
        """
        Returns the property's metadata in a format an Authenticated Attributes server will accept.

        values: the values list: [{"value": "abc"}]

        None is returned if the given prop and value can't be encoded.

        Relationships are currently unsupported, everything else should be.
        """

        if len(values) == 0 or "value" not in values[0]:
            return None

        prop = None
        for p in self.data["properties"]:
            if p["name"] == name:
                prop = p
                break
        if prop is None:
            return None

        # Handle based on type
        if prop["type"] in ("text", "rich_text", "markdown"):
            if not values[0]["value"]:
                return None
            return {"key": prop["name"], "value": values[0]["value"], "type": "str"}
        if prop["type"] == "numeric":
            if values[0]["value"] == "":
                # Numeric value not set
                return None
            return {
                "key": prop["name"],
                # Convert int to float so it's encoded properly in DAG-CBOR
                "value": float(values[0]["value"]),
                # Uwazi doesn't have separate int or float metadata types
                # So float64 is used as a catch-all
                "type": "float64",
            }
        if prop["type"] == "select":
            return {
                "key": prop["name"],
                "value": values[0]["label"],
                "type": "str",
            }
        if prop["type"] == "multiselect":
            # Like select but with multiple values
            return {
                "key": prop["name"],
                "value": [x["label"] for x in values],
                "type": "str-array",
            }
        if prop["type"] == "relationship":
            # TODO: support this
            # https://github.com/starlinglab/authenticated-attributes/issues/48
            return None
        if prop["type"] == "date":
            # Value is an Unix time integer
            return {
                "key": prop["name"],
                # Convert to Unix millis
                "value": values[0]["value"] * 1000,
                "type": "unix",
            }
        if prop["type"] == "link":
            # Example: [{"value":{"label":"","url":"https://example.com"}}]
            return {
                "key": prop["name"],
                # Extract URL, discard label
                "value": values[0]["value"]["url"],
                "type": "str",
            }
        if prop["type"] in ("image", "preview", "media"):
            # Just a slash URL for the file upload, not useful
            # Example:[{"value":"/api/files/1693944174842cwky5ffakek.png"}]
            return None
        if prop["type"] == "geolocation":
            return {"key": prop["name"], "value": values[0]["value"], "type": None}
        if prop["type"] == "generatedid":
            return {"key": prop["name"], "value": values[0]["value"], "type": "str"}

        # Unknown type
        logging.warning("Unsupported metadata type: %s", prop["type"])
        return None
