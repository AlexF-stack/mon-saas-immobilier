'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface RevenueChartDataPoint {
  month: string
  revenue: number
  label?: string
}

interface RevenueChartProps {
  data: RevenueChartDataPoint[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity={0.24} />
              <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: 'rgb(var(--text-secondary))' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'rgb(var(--text-secondary))' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgb(var(--card))',
              border: '1px solid rgb(var(--border))',
              borderRadius: '1rem',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
            }}
            labelStyle={{ color: 'rgb(var(--text-primary))' }}
            formatter={(value) => [`${Number(value ?? 0).toLocaleString('fr-FR')} FCFA`, 'Revenus']}
            labelFormatter={(label) => label}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="rgb(var(--primary))"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
