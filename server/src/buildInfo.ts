export interface BuildInfo {
  releaseTag: string;
  commitSha: string;
  buildTime: string;
}

export const BUILD_INFO: BuildInfo = {
  releaseTag: "dev",
  commitSha: "unknown",
  buildTime: "unknown",
};
