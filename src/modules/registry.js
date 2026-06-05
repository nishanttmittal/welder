/** Module registry — the welder app's single module. */
import { welderModule } from './welder/manifest'

export const modules = [welderModule]
export const getModule = (id) => modules.find(m => m.id === id) || modules[0]
