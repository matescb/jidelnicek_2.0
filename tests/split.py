import yaml
import os
from collections import defaultdict

INPUT_FILE = "jidelnicek_OpenAPI Spec.yaml"
OUTPUT_DIR = "split_contract"

os.makedirs(OUTPUT_DIR, exist_ok=True)

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    full_spec = yaml.safe_load(f)

paths_by_tag = defaultdict(dict)

for path, methods in full_spec.get("paths", {}).items():
    for method, meta in methods.items():
        tags = meta.get("tags", ["untagged"])
        for tag in tags:
            if path not in paths_by_tag[tag]:
                paths_by_tag[tag][path] = {}
            paths_by_tag[tag][path][method] = meta

for tag, paths in paths_by_tag.items():
    split_spec = {
        "openapi": full_spec["openapi"],
        "info": full_spec["info"],
        "paths": paths,
        "components": full_spec.get("components", {}),
    }

    filename = f"{tag.lower().replace(' ', '_')}.yaml"
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("# -*- coding: utf-8 -*-\n")
        yaml.dump(split_spec, f, sort_keys=False, allow_unicode=True)

print(f"Split into {len(paths_by_tag)} modules in '{OUTPUT_DIR}/'")

