import { AppServer } from '../packages/core/src/index.ts';
import BaseResource from "./resources/BaseResource.ts";
import SSEResource from './resources/SSEResource.ts';

const appServer = AppServer.instance;
appServer.registerResources([BaseResource, SSEResource]);

appServer.addEventListener('ready', async () => {
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log(appServer.app);
});

export default {
  fetch: appServer.app.fetch
}