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
import { ChatGroup, NewChat, Readers } from './ChatForms'
import { FileSheet } from './Viewer'
import { ContractAsk, ContractPdf, ContractReason, ContractRegister, NewContract, ProcessRoles } from './ContractForms'
import { KpiRules, ReportPdf, ReportReturn } from './ReportForms'
import { ScanSplit } from './ScanForms'

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
    case 'docEdit': return <DocAdd key={dialog.id} id={dialog.id} />
    case 'company': return <CompanyForm id={dialog.id} />
    case 'docRequest': return <RequestForm />
    case 'request': return <RequestSheet key={dialog.id} id={dialog.id} office={dialog.office} />
    case 'newChat': return <NewChat />
    case 'chatGroup': return <ChatGroup key={dialog.id} id={dialog.id} />
    case 'file': return <FileSheet key={dialog.file.id} file={dialog.file} />
    case 'readers': return <Readers key={dialog.id} id={dialog.id} />
    case 'newContract': return <NewContract />
    case 'contractReason': return <ContractReason key={dialog.id + dialog.step} id={dialog.id} step={dialog.step} />
    case 'contractRegister': return <ContractRegister key={dialog.id} id={dialog.id} />
    case 'contractAsk': return <ContractAsk key={dialog.id} id={dialog.id} />
    case 'contractPdf': return <ContractPdf key={dialog.id} id={dialog.id} />
    case 'processRoles': return <ProcessRoles />
    case 'reportReturn': return <ReportReturn key={dialog.id} id={dialog.id} />
    case 'reportPdf': return <ReportPdf key={dialog.id} id={dialog.id} />
    case 'kpiRules': return <KpiRules />
    case 'scanSplit': return <ScanSplit key={dialog.id} id={dialog.id} ai={dialog.ai} />
  }
}
