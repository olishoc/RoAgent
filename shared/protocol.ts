// RoAgent WebSocket Protocol v1
// Type-only shared contract for the Roblox plugin backend daemon and future TypeScript clients.
// Do not implement handlers in this file.

export const PROTOCOL_VERSION = "1" as const;
export const GLOBAL_PLACE_ID = "__global__" as const;

export type ProtocolVersion = typeof PROTOCOL_VERSION;
export type GlobalPlaceId = typeof GLOBAL_PLACE_ID;
export type Uuid = string;
export type IsoTimestamp = string;
export type PlaceId = string;
export type ScriptPath = string;
export type VersionId = string;
export type CommitRef = string;

export enum ErrorCode {
  NOT_FOUND = "NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  GIT_CONFLICT = "GIT_CONFLICT",
  AGENT_UNAVAILABLE = "AGENT_UNAVAILABLE",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  LICENSE_INVALID = "LICENSE_INVALID",
  LICENSE_EXPIRED = "LICENSE_EXPIRED",
  LICENSE_ALREADY_ACTIVATED = "LICENSE_ALREADY_ACTIVATED",
}

export type ScriptClassName = "Script" | "LocalScript" | "ModuleScript";
export type ScriptAction = "created" | "updated" | "deleted" | "renamed" | "restored";
export type WatchEventKind = ScriptAction;
export type GitFileStatusKind =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "staged"
  | "untracked"
  | "conflicted";
export type LicenseState = "ACTIVE" | "GRACE" | "UNLICENSED" | "EXPIRED";

export interface Envelope<TType extends string, TPayload extends object> {
  version: ProtocolVersion;
  type: TType;
  requestId: Uuid;
  placeId: PlaceId;
  payload: TPayload;
}

export interface ScriptRef {
  path: ScriptPath;
  uniqueId?: string;
}

export interface ScriptSummary {
  path: ScriptPath;
  uniqueId?: string;
  className: ScriptClassName;
  size: number;
  versionId: VersionId;
  updatedAt: IsoTimestamp;
  deleted: boolean;
  source?: string;
  pendingStudioDeploy?: boolean;
}

export interface ScriptRecord extends ScriptSummary {
  source: string;
}

export interface HistoryVersion {
  versionNumber?: number;
  versionId: VersionId;
  path: ScriptPath;
  uniqueId?: string;
  className: ScriptClassName;
  source?: string;
  action: ScriptAction;
  timestamp: IsoTimestamp;
  summary?: string;
  actor?: string;
  commitHash?: string;
}

export interface DeletedScriptHistory {
  path: ScriptPath;
  uniqueId?: string;
  className: ScriptClassName;
  deletedAt: IsoTimestamp;
  lastVersionId: VersionId;
  lastKnownSource?: string;
  size: number;
}

export interface WatchEvent {
  eventId: Uuid;
  kind: WatchEventKind;
  path: ScriptPath;
  uniqueId?: string;
  oldPath?: ScriptPath | null;
  script?: ScriptRecord;
  historyVersion?: HistoryVersion;
  timestamp: IsoTimestamp;
  origin: string;
}

export interface GitFileStatus {
  path: string;
  status: GitFileStatusKind;
  oldPath?: string;
}

export interface GitStatus {
  repoPath: string;
  branch: string;
  remoteUrl?: string;
  githubRepo?: string;
  ahead: number;
  behind: number;
  clean: boolean;
  files: GitFileStatus[];
}

export interface GitCommit {
  hash: string;
  message: string;
  authorName?: string;
  authorEmail?: string;
  timestamp: IsoTimestamp;
}

export interface GitDiff {
  path: ScriptPath;
  fromCommit: CommitRef;
  toCommit: CommitRef;
  diff: string;
}

export interface AgentStatus {
  running: boolean;
  pid?: number;
  terminalId?: Uuid;
  launchedAt?: IsoTimestamp;
  lastSeenAt?: IsoTimestamp;
  placeId: PlaceId;
}

export interface AgentAction {
  id?: Uuid;
  timestamp: IsoTimestamp;
  summary: string;
  tool: string;
}

export interface LicenseStatus {
  status: LicenseState;
  daysRemaining: number;
  activatedAt?: IsoTimestamp;
  machineId: string;
  expiresAt?: IsoTimestamp;
  licenseeEmail?: string;
  plan?: string;
  lastCheckedAt?: IsoTimestamp;
}

export interface DaemonStorageHealth {
  ok: boolean;
  path?: string;
  error?: string;
}

export interface DaemonGitHealth {
  available: boolean;
  version?: string;
  error?: string;
}

export interface DaemonHealth {
  ok: boolean;
  daemonVersion: string;
  protocolVersion: ProtocolVersion;
  uptimeSeconds: number;
  startedAt: IsoTimestamp;
  activeConnections: number;
  activePlaces: PlaceId[];
  storage: DaemonStorageHealth;
  git: DaemonGitHealth;
  agent?: AgentStatus;
  license?: LicenseStatus;
}

export interface ProtocolErrorPayload {
  code: ErrorCode;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export type ProtocolErrorMessage = Envelope<"error", ProtocolErrorPayload>;
export type LicenseErrorMessage = Envelope<"license:error", ProtocolErrorPayload>;

// Script messages

export interface ScriptReadRequestPayload {
  path: ScriptPath;
  uniqueId?: string;
}
export type ScriptReadRequest = Envelope<"script:read", ScriptReadRequestPayload>;
export interface ScriptReadResponsePayload {
  script: ScriptRecord;
}
export type ScriptReadResponse = Envelope<"script:read:response", ScriptReadResponsePayload>;

export interface ScriptWriteRequestPayload {
  path: ScriptPath;
  uniqueId?: string;
  source: string;
  className?: ScriptClassName;
  expectedVersionId?: VersionId;
  summary?: string;
  pendingStudioDeploy?: boolean;
  origin?: string;
}
export type ScriptWriteRequest = Envelope<"script:write", ScriptWriteRequestPayload>;
export interface ScriptWriteResponsePayload {
  script: ScriptRecord;
  historyVersion: HistoryVersion;
}
export type ScriptWriteResponse = Envelope<"script:write:response", ScriptWriteResponsePayload>;

export interface ScriptCreateRequestPayload {
  path: ScriptPath;
  uniqueId?: string;
  className: ScriptClassName;
  source: string;
  createParents?: boolean;
  overwrite?: boolean;
  summary?: string;
  pendingStudioDeploy?: boolean;
  origin?: string;
}
export type ScriptCreateRequest = Envelope<"script:create", ScriptCreateRequestPayload>;
export interface ScriptCreateResponsePayload {
  script: ScriptRecord;
  historyVersion: HistoryVersion;
}
export type ScriptCreateResponse = Envelope<"script:create:response", ScriptCreateResponsePayload>;

export interface ScriptDeleteRequestPayload {
  path: ScriptPath;
  uniqueId?: string;
  expectedVersionId?: VersionId;
  summary?: string;
  origin?: string;
}
export type ScriptDeleteRequest = Envelope<"script:delete", ScriptDeleteRequestPayload>;
export interface ScriptDeleteResponsePayload {
  path: ScriptPath;
  deleted: true;
  historyVersion: HistoryVersion;
}
export type ScriptDeleteResponse = Envelope<"script:delete:response", ScriptDeleteResponsePayload>;

export interface ScriptRenameRequestPayload {
  fromPath: ScriptPath;
  uniqueId?: string;
  toPath: ScriptPath;
  createParents?: boolean;
  expectedVersionId?: VersionId;
  summary?: string;
  pendingStudioDeploy?: boolean;
  origin?: string;
}
export type ScriptRenameRequest = Envelope<"script:rename", ScriptRenameRequestPayload>;
export interface ScriptRenameResponsePayload {
  fromPath: ScriptPath;
  toPath: ScriptPath;
  script: ScriptRecord;
  historyVersion: HistoryVersion;
}
export type ScriptRenameResponse = Envelope<"script:rename:response", ScriptRenameResponsePayload>;

export interface ScriptRestoreRequestPayload {
  path: ScriptPath;
  uniqueId?: string;
  versionId: VersionId;
  summary?: string;
  pendingStudioDeploy?: boolean;
}
export type ScriptRestoreRequest = Envelope<"script:restore", ScriptRestoreRequestPayload>;
export interface ScriptRestoreResponsePayload {
  script: ScriptRecord;
  restoredFromVersionId: VersionId;
  historyVersion: HistoryVersion;
}
export type ScriptRestoreResponse = Envelope<"script:restore:response", ScriptRestoreResponsePayload>;

export interface ScriptSyncSnapshotItem {
  path: ScriptPath;
  uniqueId?: string;
  className: ScriptClassName;
  source: string;
}
export interface ScriptSyncSnapshotRequestPayload {
  scripts: ScriptSyncSnapshotItem[];
}
export type ScriptSyncSnapshotRequest = Envelope<"script:syncSnapshot", ScriptSyncSnapshotRequestPayload>;
export interface ScriptAckDeployRequestPayload {
  paths?: ScriptPath[];
  refs?: ScriptRef[];
}
export type ScriptAckDeployRequest = Envelope<"script:ackDeploy", ScriptAckDeployRequestPayload>;
export interface ScriptAckDeployResponsePayload {
  acknowledged: ScriptRef[];
}
export type ScriptAckDeployResponse = Envelope<"script:ackDeploy:response", ScriptAckDeployResponsePayload>;
export interface ScriptCleanupStaleRequestPayload {
  paths: ScriptPath[];
  confirm?: boolean;
  includeLegacy?: boolean;
  includePending?: boolean;
  summary?: string;
}
export type ScriptCleanupStaleRequest = Envelope<"script:cleanupStale", ScriptCleanupStaleRequestPayload>;
export interface ScriptCleanupStaleSkipped {
  path: ScriptPath;
  reason: string;
}
export interface ScriptCleanupStaleResponsePayload {
  dryRun: boolean;
  candidates: ScriptRecord[];
  cleaned: ScriptRecord[];
  skipped: ScriptCleanupStaleSkipped[];
  candidateCount: number;
  cleanedCount: number;
  skippedCount: number;
}
export type ScriptCleanupStaleResponse = Envelope<"script:cleanupStale:response", ScriptCleanupStaleResponsePayload>;
export interface ScriptSyncSnapshotResponsePayload {
  scripts: ScriptRecord[];
  deleted: ScriptRecord[];
  count: number;
  deletedCount: number;
}
export type ScriptSyncSnapshotResponse = Envelope<"script:syncSnapshot:response", ScriptSyncSnapshotResponsePayload>;

export interface ScriptListRequestPayload {
  includeSource?: boolean;
  includeDeleted?: boolean;
}
export type ScriptListRequest = Envelope<"script:list", ScriptListRequestPayload>;
export interface ScriptListResponsePayload {
  scripts: ScriptSummary[];
  count: number;
  totalBytes: number;
}
export type ScriptListResponse = Envelope<"script:list:response", ScriptListResponsePayload>;

// History messages

export interface HistoryGetRequestPayload {
  path: ScriptPath;
  includeSource?: boolean;
}
export type HistoryGetRequest = Envelope<"history:get", HistoryGetRequestPayload>;
export interface HistoryGetResponsePayload {
  path: ScriptPath;
  versions: HistoryVersion[];
}
export type HistoryGetResponse = Envelope<"history:get:response", HistoryGetResponsePayload>;

export interface HistoryGetDeletedRequestPayload {
  includeSource?: boolean;
}
export type HistoryGetDeletedRequest = Envelope<"history:getDeleted", HistoryGetDeletedRequestPayload>;
export interface HistoryGetDeletedResponsePayload {
  scripts: DeletedScriptHistory[];
}
export type HistoryGetDeletedResponse = Envelope<"history:getDeleted:response", HistoryGetDeletedResponsePayload>;

// Watch messages

export interface WatchSubscribeRequestPayload {
  sinceVersionId?: VersionId;
  includeSource?: boolean;
}
export type WatchSubscribeRequest = Envelope<"watch:subscribe", WatchSubscribeRequestPayload>;
export interface WatchSubscribeResponsePayload {
  subscribed: true;
  subscriptionId: Uuid;
  placeId: PlaceId;
}
export type WatchSubscribeResponse = Envelope<"watch:subscribe:response", WatchSubscribeResponsePayload>;

export interface WatchUnsubscribeRequestPayload {
  subscriptionId: Uuid;
}
export type WatchUnsubscribeRequest = Envelope<"watch:unsubscribe", WatchUnsubscribeRequestPayload>;
export interface WatchUnsubscribeResponsePayload {
  subscribed: false;
  subscriptionId: Uuid;
}
export type WatchUnsubscribeResponse = Envelope<"watch:unsubscribe:response", WatchUnsubscribeResponsePayload>;

export type WatchEventMessage = Envelope<"watch:event", WatchEvent>;

// Git messages

export type GitStatusRequest = Envelope<"git:status", Record<string, never>>;
export type GitStatusResponse = Envelope<"git:status:response", GitStatus>;

export interface GitCommitRequestPayload {
  message?: string;
  authorName?: string;
  authorEmail?: string;
}
export type GitCommitRequest = Envelope<"git:commit", GitCommitRequestPayload>;
export interface GitCommitResponsePayload {
  commit: GitCommit;
}
export type GitCommitResponse = Envelope<"git:commit:response", GitCommitResponsePayload>;

export interface GitLogRequestPayload {
  limit?: number;
  skip?: number;
}
export type GitLogRequest = Envelope<"git:log", GitLogRequestPayload>;
export interface GitLogResponsePayload {
  commits: GitCommit[];
  hasMore: boolean;
}
export type GitLogResponse = Envelope<"git:log:response", GitLogResponsePayload>;

export interface GitDiffRequestPayload {
  path?: ScriptPath;
  fromCommit: CommitRef;
  toCommit?: CommitRef;
}
export type GitDiffRequest = Envelope<"git:diff", GitDiffRequestPayload>;
export type GitDiffResponse = Envelope<"git:diff:response", GitDiff>;

export interface GitRestoreRequestPayload {
  path: ScriptPath;
  commit: CommitRef;
  summary?: string;
}
export type GitRestoreRequest = Envelope<"git:restore", GitRestoreRequestPayload>;
export interface GitRestoreResponsePayload {
  script: ScriptRecord;
  restoredFromCommit: CommitRef;
  historyVersion: HistoryVersion;
}
export type GitRestoreResponse = Envelope<"git:restore:response", GitRestoreResponsePayload>;

export interface GitPushRequestPayload {
  remote?: string;
  branch?: string;
}
export type GitPushRequest = Envelope<"git:push", GitPushRequestPayload>;
export interface GitPushResponsePayload {
  ok: true;
  remote?: string;
  branch?: string;
  pushedAt: IsoTimestamp;
}
export type GitPushResponse = Envelope<"git:push:response", GitPushResponsePayload>;

export interface GitPullRequestPayload {
  remote?: string;
  branch?: string;
  rebase?: boolean;
}
export type GitPullRequest = Envelope<"git:pull", GitPullRequestPayload>;
export interface GitPullResponsePayload {
  ok: true;
  remote?: string;
  branch?: string;
  pulledAt: IsoTimestamp;
  fastForward?: boolean;
}
export type GitPullResponse = Envelope<"git:pull:response", GitPullResponsePayload>;

export interface GitSetRemoteRequestPayload {
  remote?: string;
  url?: string;
  remoteUrl?: string;
}
export type GitSetRemoteRequest = Envelope<"git:setRemote", GitSetRemoteRequestPayload>;
export interface GitSetRemoteResponsePayload {
  ok: true;
  remote: string;
  url: string;
}
export type GitSetRemoteResponse = Envelope<"git:setRemote:response", GitSetRemoteResponsePayload>;

export type GitGithubStatusRequest = Envelope<"git:githubStatus", Record<string, never>>;
export interface GitGithubStatusResponsePayload {
  enabled: boolean;
  owner?: string;
  privateRepos: boolean;
  hasToken: boolean;
  githubLogin?: string;
  githubAvatarUrl?: string;
  githubHtmlUrl?: string;
  updatedAt: IsoTimestamp;
}
export type GitGithubStatusResponse = Envelope<"git:githubStatus:response", GitGithubStatusResponsePayload>;

export interface GitGithubConfigureRequestPayload {
  enabled?: boolean;
  owner?: string;
  privateRepos?: boolean;
  token?: string;
}
export type GitGithubConfigureRequest = Envelope<"git:githubConfigure", GitGithubConfigureRequestPayload>;
export type GitGithubConfigureResponse = Envelope<"git:githubConfigure:response", GitGithubStatusResponsePayload>;

export type GitGithubDeviceStartRequest = Envelope<"git:githubDeviceStart", Record<string, never>>;
export interface GitGithubDeviceStartResponsePayload {
  clientId: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}
export type GitGithubDeviceStartResponse = Envelope<"git:githubDeviceStart:response", GitGithubDeviceStartResponsePayload>;

export interface GitGithubDevicePollRequestPayload {
  deviceCode: string;
}
export type GitGithubDevicePollRequest = Envelope<"git:githubDevicePoll", GitGithubDevicePollRequestPayload>;
export interface GitGithubDevicePollResponsePayload extends Partial<GitGithubStatusResponsePayload> {
  authorized: boolean;
  pending: boolean;
  error?: string;
  message?: string;
}
export type GitGithubDevicePollResponse = Envelope<"git:githubDevicePoll:response", GitGithubDevicePollResponsePayload>;

export interface GitAutoRemoteRequestPayload {
  remote?: string;
  force?: boolean;
  placeName?: string;
  repoName?: string;
}
export type GitAutoRemoteRequest = Envelope<"git:autoRemote", GitAutoRemoteRequestPayload>;
export interface GitAutoRemoteResponsePayload {
  ok: true;
  created: boolean;
  reused: boolean;
  remote: string;
  url: string;
  repo?: string;
  htmlUrl?: string;
}
export type GitAutoRemoteResponse = Envelope<"git:autoRemote:response", GitAutoRemoteResponsePayload>;

// Agent messages

export interface AgentLaunchRequestPayload {
  cwd?: string;
  args?: string[];
}
export type AgentLaunchRequest = Envelope<"agent:launch", AgentLaunchRequestPayload>;
export type AgentLaunchResponse = Envelope<"agent:launch:response", AgentStatus>;

export type AgentKillRequest = Envelope<"agent:kill", Record<string, never>>;
export interface AgentKillResponsePayload {
  running: false;
  pid?: number;
  killedAt: IsoTimestamp;
}
export type AgentKillResponse = Envelope<"agent:kill:response", AgentKillResponsePayload>;

export type AgentStatusRequest = Envelope<"agent:status", Record<string, never>>;
export type AgentStatusResponse = Envelope<"agent:status:response", AgentStatus>;

export type AgentActionMessage = Envelope<"agent:action", AgentAction>;

export type AgentRecentActionsRequest = Envelope<"agent:recentActions", Record<string, never>>;
export interface AgentRecentActionsResponsePayload {
  actions: AgentAction[];
}
export type AgentRecentActionsResponse = Envelope<"agent:recentActions:response", AgentRecentActionsResponsePayload>;

// License messages

export interface LicenseActivateRequestPayload {
  licenseKey: string;
  deviceName?: string;
}
export type LicenseActivateRequest = Envelope<"license:activate", LicenseActivateRequestPayload>;
export type LicenseActivateResponse = Envelope<"license:activate:response", LicenseStatus>;

export type LicenseStatusRequest = Envelope<"license:status", Record<string, never>>;
export type LicenseStatusResponse = Envelope<"license:status:response", LicenseStatus>;

export interface LicenseWarningPayload {
  code?: ErrorCode.LICENSE_EXPIRED;
  message: string;
  expiresAt: IsoTimestamp;
  daysRemaining: number;
}
export type LicenseWarningMessage = Envelope<"license:warning", LicenseWarningPayload>;

export interface LicenseRevokedPayload {
  code: ErrorCode.LICENSE_INVALID | ErrorCode.LICENSE_EXPIRED;
  message: string;
  revokedAt: IsoTimestamp;
}
export type LicenseRevokedMessage = Envelope<"license:revoked", LicenseRevokedPayload>;

// Daemon messages

export type DaemonHealthRequest = Envelope<"daemon:health", Record<string, never>>;
export type DaemonHealthResponse = Envelope<"daemon:health:response", DaemonHealth>;

// Discriminated unions

export type ScriptRequestMessage =
  | ScriptReadRequest
  | ScriptWriteRequest
  | ScriptCreateRequest
  | ScriptDeleteRequest
  | ScriptRenameRequest
  | ScriptRestoreRequest
  | ScriptSyncSnapshotRequest
  | ScriptAckDeployRequest
  | ScriptCleanupStaleRequest
  | ScriptListRequest;

export type ScriptResponseMessage =
  | ScriptReadResponse
  | ScriptWriteResponse
  | ScriptCreateResponse
  | ScriptDeleteResponse
  | ScriptRenameResponse
  | ScriptRestoreResponse
  | ScriptSyncSnapshotResponse
  | ScriptAckDeployResponse
  | ScriptCleanupStaleResponse
  | ScriptListResponse;

export type HistoryRequestMessage = HistoryGetRequest | HistoryGetDeletedRequest;
export type HistoryResponseMessage = HistoryGetResponse | HistoryGetDeletedResponse;

export type WatchRequestMessage = WatchSubscribeRequest | WatchUnsubscribeRequest;
export type WatchResponseMessage = WatchSubscribeResponse | WatchUnsubscribeResponse;

export type GitRequestMessage =
  | GitStatusRequest
  | GitCommitRequest
  | GitLogRequest
  | GitDiffRequest
  | GitRestoreRequest
  | GitPushRequest
  | GitPullRequest
  | GitSetRemoteRequest
  | GitGithubStatusRequest
  | GitGithubConfigureRequest
  | GitGithubDeviceStartRequest
  | GitGithubDevicePollRequest
  | GitAutoRemoteRequest;

export type GitResponseMessage =
  | GitStatusResponse
  | GitCommitResponse
  | GitLogResponse
  | GitDiffResponse
  | GitRestoreResponse
  | GitPushResponse
  | GitPullResponse
  | GitSetRemoteResponse
  | GitGithubStatusResponse
  | GitGithubConfigureResponse
  | GitGithubDeviceStartResponse
  | GitGithubDevicePollResponse
  | GitAutoRemoteResponse;

export type AgentRequestMessage =
  | AgentLaunchRequest
  | AgentKillRequest
  | AgentStatusRequest
  | AgentRecentActionsRequest;

export type AgentResponseMessage =
  | AgentLaunchResponse
  | AgentKillResponse
  | AgentStatusResponse
  | AgentRecentActionsResponse;

export type LicenseRequestMessage = LicenseActivateRequest | LicenseStatusRequest;
export type LicenseResponseMessage = LicenseActivateResponse | LicenseStatusResponse | LicenseErrorMessage;

export type DaemonRequestMessage = DaemonHealthRequest;
export type DaemonResponseMessage = DaemonHealthResponse;

export type ClientToServerMessage =
  | ScriptRequestMessage
  | HistoryRequestMessage
  | WatchRequestMessage
  | GitRequestMessage
  | AgentRequestMessage
  | LicenseRequestMessage
  | DaemonRequestMessage;

export type RequestMessage = ClientToServerMessage;

export type SuccessResponseMessage =
  | ScriptResponseMessage
  | HistoryResponseMessage
  | WatchResponseMessage
  | GitResponseMessage
  | AgentResponseMessage
  | LicenseActivateResponse
  | LicenseStatusResponse
  | DaemonResponseMessage;

export type ResponseMessage = SuccessResponseMessage | ProtocolErrorMessage | LicenseErrorMessage;

export type ServerPushMessage =
  | WatchEventMessage
  | AgentActionMessage
  | LicenseWarningMessage
  | LicenseRevokedMessage;

export type ServerToClientMessage = ResponseMessage | ServerPushMessage;

export type ProtocolMessage = ClientToServerMessage | ServerToClientMessage;

export type ClientMessageType = ClientToServerMessage["type"];
export type ServerMessageType = ServerToClientMessage["type"];
export type ProtocolMessageType = ProtocolMessage["type"];
