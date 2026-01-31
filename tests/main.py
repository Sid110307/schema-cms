from schema_cms.app import main as run_cms
from schema_cms.ext import register_object_schema, register_schema, set_export_label_resolver

SCHEMAS = {
    "welcomeDoc":   {"kind": "document"},
    "mediaGallery": {"kind": "asset_collection"},
    "publications": {
        "kind":        "collection",
        "item_schema": "publication",
        "title_field": "Publications",
        "reverse":     True,
    },
    "teamGraph":    {
        "kind":          "graph",
        "title_field":   "Team",
        "field_schemas": {
            "lead":       "person",
            "contact":    "contact",
            "members":    "person",
            "highlights": "newsItem",
        },
    },
    "siteConfig":   {
        "kind":          "graph",
        "title_field":   "Site Config",
        "field_schemas": {
            "hero":   "hero",
            "footer": "footer",
        },
    },
}

OBJECT_SCHEMAS = {
    "publication": {
        "title":         "string",
        "authors":       "string",
        "publisherName": "string",
        "year":          "string",
        "link":          "string",
    },
    "person":      {
        "name":           "string",
        "designation":    "string",
        "specialRemarks": "string",
        "img":            "image",
    },
    "contact":     {
        "office": "string",
        "lab":    "string",
        "email":  "string",
    },
    "newsItem":    {
        "title": "string",
        "link":  "string",
    },
    "hero":        {
        "headline": "string",
        "subtext":  "string",
        "ctaText":  "string",
        "ctaLink":  "string",
        "banner":   "image",
    },
    "footer":      {
        "copyright": "string",
        "links":     "newsItem",
    },
}

NAME_MAPPING = [
    ("welcomeDoc", "Welcome Document"),
    ("mediaGallery", "Media Gallery"),
    ("publications", "Publications"),
    ("teamGraph", "Team Information"),
    ("siteConfig", "Site Configuration"),
]

if __name__ == "__main__":
    for name, schema in SCHEMAS.items():
        register_schema(name, schema)
    for name, schema in OBJECT_SCHEMAS.items():
        register_object_schema(name, schema)

    set_export_label_resolver(lambda name: dict(NAME_MAPPING).get(name, name))
    run_cms()
