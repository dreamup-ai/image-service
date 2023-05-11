import { build, start } from "./server";

build({ logger: true })
  .then((server) => start(server))
  .catch((e: any) => {
    console.error(e);
    process.exit(1);
  });
