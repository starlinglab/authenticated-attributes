import "./app.css";
import App from "./App.svelte";

const app = new App({
  target: document.getElementById("hyperbee-entity-page-app"),
  props: {
    NO_EDIT_BUTTON_IN_PROD: true,
    IPFS_GATEWAY: "https://ipfs.hypha.coop",
    // Not needed anymore due to using custom /authattr/replay/ path
    // REPLAYWEB_SW_FILENAME: "1686854119383k87q2hyjd7a.js",
  },
});

export default app;
