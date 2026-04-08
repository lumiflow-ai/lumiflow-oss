import { RouteGroup } from "@/lib/routeGroup";

import { createArtifact } from "./createArtifact";
import { createSnapshots } from "./createSnapshots";
import { deleteContents } from "./deleteArtifactContents";
import { exportDataset } from "./exportDataset";
import { loadContents } from "./loadArtifactContents";
import { recordContents } from "./recordArtifactContents";
import { updateSnapshot } from "./updateSnapshot";

const snapshotRoutes = new RouteGroup("snapshots");
snapshotRoutes.install(createSnapshots);
snapshotRoutes.install(updateSnapshot);

export const artifactRoutes = new RouteGroup("artifacts");
artifactRoutes.install(snapshotRoutes);
artifactRoutes.install(loadContents);
artifactRoutes.install(recordContents);
artifactRoutes.install(deleteContents);
artifactRoutes.install(createArtifact);
artifactRoutes.install(exportDataset);
