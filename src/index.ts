import * as dotenv from "dotenv";
dotenv.config({ override: true, path: `./.env.${process.env.APP_ENV}` });

import { start, build } from "./server";

build({ logger: true })
  .then((server) => start(server))
  .catch((e: any) => {
    console.error(e);
    process.exit(1);
  });
