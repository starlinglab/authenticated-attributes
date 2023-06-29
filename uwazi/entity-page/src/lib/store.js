// Adapted from https://chasingcode.dev/blog/svelte-persist-state-to-localstorage/

import { writable } from "svelte/store";

// Stored as JSON
const storedSources = localStorage.getItem("hyperbeeSources");
export const hyperbeeSources = writable(
  (storedSources && JSON.parse(storedSources)) || []
);
hyperbeeSources.subscribe((value) => {
  localStorage.setItem(
    "hyperbeeSources",
    (value && JSON.stringify(value)) || "[]"
  );
});

// Stored directly as a string (URL)
const storedPersonal = localStorage.getItem("personalHyperbee");
export const personalHyperbee = writable(storedPersonal || "");
personalHyperbee.subscribe((value) => {
  localStorage.setItem("personalHyperbee", value || "");
});
