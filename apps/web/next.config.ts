import type {NextConfig} from 'next';
import {resolve} from 'node:path';
const config:NextConfig={turbopack:{root:process.env.POC_ROOT??process.cwd()}};export default config;
