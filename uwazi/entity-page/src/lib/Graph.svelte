<!--
SPV5: Authenticated data graph of verification records

Displays a directed graph of relations for the current asset.

Vis docs:
- https://visjs.github.io/vis-network/docs/network/
- https://visjs.github.io/vis-network/examples/
- https://visjs.github.io/vis-data/data/dataset.html
-->

<script>
  // Map of CIDs to another map containing their "childOf" and "parentOf" data.
  export let data;
  export let mainCid;

  // Process data

  let nodes = new vis.DataSet();
  let edges = new vis.DataSet();

  for (const [cid, relations] of Object.entries(data)) {
    // cid variable is a string, but all others are CID objects.

    nodes.update({ id: cid, label: cid });

    if (relations.parentOf) {
      for (const child of relations.parentOf) {
        nodes.update({
          id: child.toString(),
          label: child.toString(),
        });
        edges.add({
          from: cid,
          to: child.toString(),
        });
      }
    }
    if (relations.childOf) {
      for (const parent of relations.childOf) {
        nodes.update({
          id: parent.toString(),
          label: parent.toString(),
        });
        edges.add({
          from: parent.toString(),
          to: cid,
        });
      }
    }
  }

  // Add color to main CID to highlight it
  nodes.update({
    id: mainCid,
    label: mainCid,
    color: "rgb(98, 0, 238)",
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
          smooth: false,
          arrows: {
            to: {
              enabled: true,
            },
          },
          color: "grey",
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

<div bind:this={container} id="vis-container" />

<style>
  #vis-container {
    height: 100%;
    width: 100%;
    display: block;
  }
</style>
