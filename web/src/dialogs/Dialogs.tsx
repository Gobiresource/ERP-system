import { useUi } from '../lib/ui'
import { Shortcuts } from '../shell/Shortcuts'
import { PersonDrawer } from './PersonDrawer'
import { Invite } from './Invite'
import { TaskDrawer } from './TaskDrawer'
import { NewTask } from './NewTask'
import { NewProject, ProjectTeam } from './NewProject'
import { EventDrawer } from './EventDrawer'
import { NewEvent } from './NewEvent'
import { DeptForm, PositionForm } from './HrForms'
import { CompanyForm, DocAdd, DocSheet, RequestForm, RequestSheet } from './DocForms'

/** Shows the window that is open right now (one at a time). Reads the store itself, so opening one does not redraw the page. */
export function Dialogs() {
  const { dialog } = useUi()
  if (!dialog) return null
  switch (dialog.kind) {
    case 'shortcuts': return <Shortcuts />
    case 'person': return <PersonDrawer key={dialog.id} id={dialog.id} />
    case 'invite': return <Invite />
    case 'task': return <TaskDrawer key={dialog.id} id={dialog.id} />
    case 'newTask': return <NewTask defaults={dialog.defaults} />
    case 'newProject': return <NewProject />
    case 'projectTeam': return <ProjectTeam key={dialog.id} id={dialog.id} />
    case 'event': return <EventDrawer key={dialog.id} id={dialog.id} />
    case 'newEvent': return <NewEvent defaults={dialog.defaults} />
    case 'dept': return <DeptForm id={dialog.id} />
    case 'position': return <PositionForm id={dialog.id} dept={dialog.dept} />
    case 'doc': return <DocSheet key={dialog.id} id={dialog.id} />
    case 'docAdd': return <DocAdd company={dialog.company} />
    case 'company': return <CompanyForm id={dialog.id} />
    case 'docRequest': return <RequestForm />
    case 'request': return <RequestSheet key={dialog.id} id={dialog.id} office={dialog.office} />
  }
}
