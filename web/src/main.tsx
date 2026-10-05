// Must be first: registers the OTel SDKs before anything else runs.
import './otel'

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode omitted: double-invoked effects would double up API calls/spans in dev.
createRoot(document.getElementById('root')!).render(<App />)
