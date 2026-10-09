// SPDX-License-Identifier: Apache-2.0
import { Routes, Route } from "react-router-dom";
import AppShell from "./components/Layout/AppShell";
import NoteView from "./components/Viewer/NoteView";
import GraphView from "./components/Graph/GraphView";

export default function App() {
	return (
		<Routes>
			<Route element={<AppShell />}>
				{/* The site root is the vault's Anthers Overview — the wiki's home page. */}
				<Route path="/" element={<NoteView />} />
				<Route path="/graph" element={<GraphView />} />
				{/* Every other address is a slug (two-level, JD-stripped) resolved by NoteView. */}
				<Route path="/*" element={<NoteView />} />
			</Route>
		</Routes>
	);
}