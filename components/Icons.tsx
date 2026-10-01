type IconProps = { size?: number }

const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
})

export function HomeIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg> }
export function BookIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5v16"/></svg> }
export function DnaIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M7 3c5 4 5 14 10 18"/><path d="M17 3C12 7 12 17 7 21"/><path d="M9 6h6M8 10h8M8 14h8M9 18h6"/></svg> }
export function DatabaseIcon({ size }: IconProps) { return <svg {...base(size)}><ellipse cx="12" cy="5" rx="7.5" ry="3"/><path d="M4.5 5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5"/><path d="M4.5 11v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/></svg> }
export function FlaskIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 15h9"/></svg> }
export function SparkIcon({ size }: IconProps) { return <svg {...base(size)}><path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9z"/><path d="m18 14 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7z"/></svg> }
export function SearchIcon({ size }: IconProps) { return <svg {...base(size)}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg> }
export function SamplesIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M7 3h10M9 3v5l-4 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 17l-4-9V3"/><path d="M8 14h8"/></svg> }
export function InventoryIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M4 6.5 12 3l8 3.5-8 3.5z"/><path d="M4 6.5V17l8 4 8-4V6.5"/><path d="M12 10v11"/></svg> }
export function LabIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M8 3v5l-4 10a2 2 0 0 0 1.9 3h12.2A2 2 0 0 0 20 18L16 8V3"/><path d="M7 14h10"/><path d="M8 3h8"/></svg> }
export function ShieldIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M12 3 19 6v5c0 4.6-2.7 8-7 10-4.3-2-7-5.4-7-10V6z"/><path d="m9 12 2 2 4-4"/></svg> }
export function PlusIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M12 5v14M5 12h14"/></svg> }
export function TrashIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg> }
export function DownloadIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg> }
export function UploadIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg> }
export function RegistryIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M5 4h14v5H5zM5 15h14v5H5z"/><path d="M8 9v6M16 9v6"/></svg> }
export function WorkflowIcon({ size }: IconProps) { return <svg {...base(size)}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H14a4 4 0 0 1 4 4v5.5M15.5 18H10a4 4 0 0 1-4-4V8.5"/></svg> }
export function FolderIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> }
export function SettingsIcon({ size }: IconProps) { return <svg {...base(size)}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a8 8 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 1.7 1l.3 3.1h5l.3-3.1a8 8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z"/></svg> }
export function CloudIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.3-1.8A4.5 4.5 0 0 0 7 18z"/></svg> }
export function HelpIcon({ size }: IconProps) { return <svg {...base(size)}><circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.7 2.7 0 1 1 4.5 2c-.8.7-1.6 1.2-1.6 2.4"/><circle cx="12" cy="17.2" r=".9" fill="currentColor" stroke="none"/></svg> }
export function LinkIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 1 0 12 20.1l1.1-1.1"/></svg> }
export function ActivityIcon({ size }: IconProps) { return <svg {...base(size)}><path d="M3 12h4l2-6 4 12 2-6h6"/></svg> }
