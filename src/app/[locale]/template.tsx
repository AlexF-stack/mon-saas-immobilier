export default function LocaleTemplate({
    children,
}: {
    children: React.ReactNode
}) {
    return <div className="animate-route-enter">{children}</div>
}
