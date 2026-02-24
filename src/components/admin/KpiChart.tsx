'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16a34a" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
          </defs>
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
              background: 'linear-gradient(135deg, rgb(var(--card) / 0.95), rgb(var(--surface) / 0.92))',
              border: '1px solid rgb(var(--border) / 0.8)',
              borderRadius: '0.95rem',
              boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
              backdropFilter: 'blur(8px)',
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
          <Area
            type="monotone"
            dataKey="grossVolume"
            stroke="#2563eb"
            fill="url(#grossGradient)"
            strokeWidth={2.6}
            dot={false}
            activeDot={{ r: 4 }}
            animationDuration={800}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="netCashFlow"
            stroke="#16a34a"
            fill="url(#netGradient)"
            strokeWidth={2.6}
            dot={false}
            activeDot={{ r: 4 }}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
