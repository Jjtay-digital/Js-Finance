import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const FALLBACK_RATES = [
  { status: 'sc', minAge: 0, maxAge: 35, employeeRate: 0.2, employerRate: 0.17, oaRate: 0.23, saRate: 0.06, maRate: 0.08 },
  { status: 'sc', minAge: 36, maxAge: 45, employeeRate: 0.2, employerRate: 0.17, oaRate: 0.21, saRate: 0.07, maRate: 0.09 },
  { status: 'sc', minAge: 46, maxAge: 50, employeeRate: 0.2, employerRate: 0.17, oaRate: 0.19, saRate: 0.08, maRate: 0.1 },
  { status: 'sc', minAge: 51, maxAge: 55, employeeRate: 0.2, employerRate: 0.17, oaRate: 0.15, saRate: 0.115, maRate: 0.105 },
  { status: 'sc', minAge: 56, maxAge: 60, employeeRate: 0.17, employerRate: 0.155, oaRate: 0.12, saRate: 0.095, maRate: 0.11 },
  { status: 'sc', minAge: 61, maxAge: 65, employeeRate: 0.13, employerRate: 0.12, oaRate: 0.035, saRate: 0.075, maRate: 0.14 },
  { status: 'sc', minAge: 66, maxAge: 70, employeeRate: 0.075, employerRate: 0.09, oaRate: 0.01, saRate: 0.025, maRate: 0.13 },
  { status: 'sc', minAge: 71, maxAge: 200, employeeRate: 0.05, employerRate: 0.075, oaRate: 0.01, saRate: 0.01, maRate: 0.105 },
]

export async function GET() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data, error } = await supabase
      .from('cpf_rate_bands')
      .select('status,min_age,max_age,employee_rate,employer_rate,oa_rate,sa_rate,ma_rate')
      .order('min_age', { ascending: true })

    if (error || !data || data.length === 0) {
      return NextResponse.json({ rates: FALLBACK_RATES, source: 'fallback' })
    }

    return NextResponse.json({
      rates: data.map((r: any) => ({
        status: r.status,
        minAge: r.min_age,
        maxAge: r.max_age,
        employeeRate: r.employee_rate,
        employerRate: r.employer_rate,
        oaRate: r.oa_rate,
        saRate: r.sa_rate,
        maRate: r.ma_rate,
      })),
      source: 'supabase',
    })
  } catch {
    return NextResponse.json({ rates: FALLBACK_RATES, source: 'fallback' })
  }
}
