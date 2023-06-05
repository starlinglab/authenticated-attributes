<!--
SPV5: Authenticated data graph of verification records

Displays a directed graph of relations for the current asset.

Vis docs:
- https://visjs.github.io/vis-network/docs/network/
- https://visjs.github.io/vis-network/examples/
- https://visjs.github.io/vis-data/data/dataset.html
-->

<script>
  import { hyperbeeSources } from "./store.js";

  // See graphData variable in App.svelte for schema
  export let data;

  // CID string of current asset
  export let mainCid;

  // Color edges according to the source that defined them
  const sourceColors = {
    // Monokai
    0: "#ff6188",
    1: "#fc9867",
    2: "#ffd866",
    3: "#a9dc76",
    4: "#78dce8",
    5: "#ab9df2",
  };

  // Process data

  let nodes = new vis.DataSet();
  let edges = new vis.DataSet();

  for (const [cid, relations] of Object.entries(data)) {
    // cid variable is a string, but all others are CID objects.

    nodes.update({ id: cid, label: cid });

    if (relations.parentOf) {
      for (const [source, children] of Object.entries(relations.parentOf)) {
        for (const child of children) {
          console.log(edges);
          nodes.update({
            id: child.toString(),
            label: child.toString(),
          });
          if (!edges.get(`parentOf-${cid}-${child}`)) {
            // Only add edge if it doesn't already exist
            edges.update({
              id: `parentOf-${cid}-${child}`,
              from: cid,
              to: child.toString(),
              label: "<b>parentOf</b>",
              color: source < 6 ? sourceColors[source] : "grey",
            });
          }
        }
      }
    }
    if (relations.childOf) {
      for (const [source, parents] of Object.entries(relations.childOf)) {
        for (const parent of parents) {
          nodes.update({
            id: parent.toString(),
            label: parent.toString(),
          });
          if (!edges.get(`childOf-${parent}-${cid}`)) {
            // Only add edge if it doesn't already exist
            edges.update({
              id: `childOf-${parent}-${cid}`,
              from: parent.toString(),
              to: cid,
              label: "\n\n<b>childOf</b>",
              color: source < 6 ? sourceColors[source] : "grey",
            });
          }
        }
      }
    }
  }

  // Add color to main CID to highlight it
  nodes.update({
    id: mainCid,
    label: mainCid,
    color: "black",
    font: { color: "white" },
  });

  // Create a network
  let container; // div Element
  $: if (container) {
    let network = new vis.Network(
      container,
      { nodes, edges },
      {
        layout: {
          hierarchical: {
            enabled: true,
            direction: "UD",
            sortMethod: "directed",
            nodeSpacing: 450, // Right size for CID text width
          },
        },
        physics: {
          enabled: false,
        },
        edges: {
          smooth: {
            enabled: true,
            type: "dynamic",
          },
          arrows: {
            to: {
              enabled: true,
            },
          },
          color: "grey",
          font: { color: "black", align: "horizontal", multi: "html" },
          labelHighlightBold: false,
        },
        nodes: {
          shape: "box",
          color: "grey",
          font: { color: "white" },
        },
      }
    );
  }
</script>

<div id="container">
  <p>
    Source colors:
    {#each $hyperbeeSources as { name, server }, i}
      <span style:color={sourceColors[i]}>{name} </span>
    {/each}
  </p>
  <div bind:this={container} id="vis-container" />
</div>

<style>
  #container {
    display: flex;
    height: 100%;
    width: 100%;
    flex-direction: column;
  }
  #vis-container {
    flex-grow: 1;
    display: block;
    width: 100%;
    height: 100%;
  }
  p {
    height: fit-content;
    margin-left: 1em;
  }
</style>
