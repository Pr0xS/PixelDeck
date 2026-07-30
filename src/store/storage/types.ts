export interface ProjectMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ProjectStorageAdapter {
  listProjects(): Promise<ProjectMeta[]>
  loadProject(id: string): Promise<string | null>
  saveProject(meta: ProjectMeta, json: string): Promise<void>
  deleteProject(id: string): Promise<void>
  renameProject(id: string, name: string): Promise<void>
  getActiveProjectId(): Promise<string | null>
  setActiveProjectId(id: string | null): Promise<void>
}

export class ProjectConflictError extends Error {
  readonly projectId: string

  constructor(projectId: string, message = `Project "${projectId}" was modified elsewhere and could not be saved.`) {
    super(message)
    this.name = 'ProjectConflictError'
    this.projectId = projectId
  }
}
