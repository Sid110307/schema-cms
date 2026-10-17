import { backend, mount } from "./index";
import type { CmsOptions } from "./types";

async function start() {
	const launch = await backend.launchConfig();
	const config = (launch.config ?? {}) as CmsOptions & { dataDir?: string; entryGlob?: string; imagesDir?: string };
	const env = launch.env;

	mount("#root", {
		...config,
		title: config.title ?? env.SCHEMA_CMS_APP_TITLE ?? "Schema CMS",
		imagePrefix: config.imagePrefix ?? env.SCHEMA_CMS_JS_IMAGE_PREFIX ?? "/images/",
		paths: {
			dataDir: config.dataDir ?? env.SCHEMA_CMS_DATA_ENTRIES_DIR,
			entryGlob: config.entryGlob ?? env.SCHEMA_CMS_ENTRY_GLOB,
			imagesDir: config.imagesDir ?? env.SCHEMA_CMS_PUBLIC_IMAGES_DIR,
		},
	});
}

start().catch((e) => {
	document.body.textContent = `Failed to start: ${e instanceof Error ? e.message : String(e)}`;
});
