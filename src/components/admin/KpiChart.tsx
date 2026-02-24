'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type KpiChartPoint = {
  date: string
  label: string
  grossVolume: number
  netCashFlow: number
}

type KpiChartProps = {
  data: KpiChartPoint[]
}

function compactAmount(value: number) {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k`
  }
  return `${value}`
}

export function KpiChart({ data }: KpiChartProps) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'rgb(var(--text-secondary))' }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'rgb(var(--text-secondary))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => compactAmount(Number(v ?? 0))}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgb(var(--card))',
              border: '1px solid rgb(var(--border))',
              borderRadius: '1rem',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
            }}
            labelStyle={{ color: 'rgb(var(--text-primary))' }}
            formatter={(value: unknown, key: string | undefined) => {
              const amount = Number(value ?? 0)
              const label = key === 'grossVolume' ? 'Gross Volume' : 'Net Cash Flow'
              return [`${amount.toLocaleString('fr-FR')} FCFA`, label]
            }}
            labelFormatter={(_, payload) => {
              const point = payload?.[0]?.payload as KpiChartPoint | undefined
              return point?.date ?? ''
            }}
          />
          <Legend
            verticalAlign="top"
            height={24}
            formatter={(value) => (value === 'grossVolume' ? 'Gross Volume' : 'Net Cash Flow')}
          />
          <Line
            type="monotone"
            dataKey="grossVolume"
            stroke="#2563eb"
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="netCashFlow"
            stroke="#16a34a"
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
