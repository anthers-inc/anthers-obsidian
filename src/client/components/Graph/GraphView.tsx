// SPDX-License-Identifier: Apache-2.0
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Graph from "graphology";
import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSetSettings,
} from "@react-sigma/core";
import { useGraph } from "../../hooks/useGraph";
import { useSlugMap } from "../../hooks/useSlugMap";

function GraphLoader() {
  const { data } = useGraph();
  const { data: slugMap } = useSlugMap();
  const loadGraph = useLoadGraph();
  const registerEvents = useRegisterEvents();
  const setSettings = useSetSettings();
  const navigate = useNavigate();

  // Load graph data into graphology
  useEffect(() => {
    if (!data) return;

    const graph = new Graph();

    // Add nodes with random positions (ForceAtlas2 will rearrange)
    for (const node of data.nodes) {
      graph.addNode(node.id, {
        label: node.name,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 4,
        color: "#7f6df2",
      });
    }

    // Add edges
    for (const edge of data.edges) {
      if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
        if (!graph.hasEdge(edge.source, edge.target)) {
          graph.addEdge(edge.source, edge.target, {
            color: "#444",
            size: 1,
          });
        }
      }
    }

    // Scale node size by degree
    graph.forEachNode((node) => {
      const degree = graph.degree(node);
      graph.setNodeAttribute(node, "size", Math.max(3, Math.min(15, 3 + degree * 0.8)));
    });

    loadGraph(graph);
  }, [data, loadGraph]);

  // Configure sigma settings
  useEffect(() => {
    setSettings({
      labelRenderedSizeThreshold: 8,
      labelColor: { color: "#dcddde" },
      defaultEdgeColor: "#444",
      defaultNodeColor: "#7f6df2",
    });
  }, [setSettings]);

  // Handle node click → navigate to the note's public slug
  useEffect(() => {
    registerEvents({
      clickNode: (event: { node: string }) => {
        const path = event.node;
        const slug = slugMap?.byPath[path];
        if (slug) navigate(`/${slug}`);
      },
    });
  }, [registerEvents, navigate, slugMap]);

  return null;
}

export default function GraphView() {
  const { isLoading, error } = useGraph();

  if (isLoading) {
    return <div className="graph-loading">Loading graph...</div>;
  }

  if (error) {
    return <div className="graph-error">Failed to load graph data</div>;
  }

  return (
    <div className="graph-view">
      <SigmaContainer
        style={{ width: "100%", height: "100%" }}
        settings={{
          allowInvalidContainer: true,
        }}
      >
        <GraphLoader />
      </SigmaContainer>
    </div>
  );
}
