import { execFile, spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'
import process from 'node:process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const TEST_PORT = Number.parseInt(process.env.TEST_PORT ?? '3520', 10)
const TEST_DB_URL = process.env.INTEGRATION_TEST_DATABASE_URL ?? 'file:./test.db'
const TEST_JWT_SECRET =
  process.env.INTEGRATION_TEST_JWT_SECRET ??
  'integration_test_secret_abcdefghijklmnopqrstuvwxyz_123456'
const READY_URL = `http://127.0.0.1:${TEST_PORT}/api/properties`

const integrationEnv = {
  ...process.env,
  NODE_ENV: 'production',
  DATABASE_URL: TEST_DB_URL,
  JWT_SECRET: TEST_JWT_SECRET,
  TEST_PORT: String(TEST_PORT),
  NEXT_TELEMETRY_DISABLED: '1',
  ENABLE_TEST_CONTRACT_ROLLBACK: '1',
}

let serverProcess = null

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: integrationEnv,
      stdio: 'inherit',
      shell: false,
      ...options,
    })

    child.once('error', (error) => {
      reject(error)
    })

    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          `${command} ${args.join(' ')} failed with code ${code ?? 'null'} and signal ${
            signal ?? 'null'
          }`
        )
      )
    })
  })
}

async function listPidsByPort(port) {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp'])
    const pids = new Set()
    const marker = `:${port}`

    for (const line of stdout.split(/\r?\n/)) {
      if (!line.includes(marker) || !line.includes('LISTENING')) continue
      const columns = line.trim().split(/\s+/)
      const localAddress = columns[1] ?? ''
      const state = columns[3] ?? ''
      const pid = columns[4] ?? ''

      if (!localAddress.endsWith(marker)) continue
      if (state !== 'LISTENING') continue
      if (/^\d+$/.test(pid)) pids.add(pid)
    }

    return [...pids]
  }

  try {
    const { stdout } = await execFileAsync('lsof', ['-ti', `tcp:${port}`])
    return stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter((value) => /^\d+$/.test(value))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 1) {
      return []
    }
    throw error
  }
}

async function killPid(pid) {
  if (process.platform === 'win32') {
    try {
      await execFileAsync('taskkill', ['/PID', String(pid), '/F'])
    } catch (error) {
      // Ignore already-exited processes.
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 128)) {
        throw error
      }
    }
    return
  }

  await execFileAsync('kill', ['-9', String(pid)])
}

async function killPort(port) {
  const pids = await listPidsByPort(port)
  for (const pid of pids) {
    if (String(pid) === String(process.pid)) continue
    await killPid(pid)
    console.log(`[integration] killed pid ${pid} on port ${port}`)
  }
}

async function waitForServerReady(timeoutMs = 90_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`Server exited early with code ${serverProcess.exitCode}`)
    }

    try {
      const response = await fetch(READY_URL, { redirect: 'manual' })
      if (response.status < 500) return
    } catch {
      // Ignore while the server is booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Test server was not ready within ${timeoutMs}ms`)
}

async function stopServer() {
  if (!serverProcess) return

  const ref = serverProcess
  serverProcess = null

  if (ref.exitCode !== null) return

  ref.kill('SIGTERM')

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_000)
    ref.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })
  })

  if (ref.exitCode === null) {
    ref.kill('SIGKILL')
  }
}

async function main() {
  console.log('[integration] cleaning ports 3000 and 3520')
  await Promise.all([killPort(3000), killPort(TEST_PORT)])

  console.log('[integration] removing .next cache')
  await rm('.next', { recursive: true, force: true })

  console.log('[integration] applying database migrations on test database')
  await runCommand(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'])

  console.log('[integration] building project (production)')
  await runCommand(process.execPath, ['node_modules/next/dist/bin/next', 'build'])

  console.log(`[integration] starting server on port ${TEST_PORT}`)
  serverProcess = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '-p', String(TEST_PORT)],
    {
      cwd: process.cwd(),
      env: integrationEnv,
      stdio: 'inherit',
      shell: false,
    }
  )

  serverProcess.once('error', (error) => {
    console.error('[integration] failed to start server', error)
  })

  await waitForServerReady()

  console.log('[integration] running integration tests')
  await runCommand(process.execPath, ['--test', 'tests/integration/security-rbac.integration.test.mjs'])
}

try {
  await main()
} catch (error) {
  console.error('[integration] failed', error)
  process.exitCode = 1
} finally {
  await stopServer()
}
