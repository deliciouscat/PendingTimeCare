import type {AuthConfig} from 'convex/server';
import jwks from '../config/auth-public.json';
export default {providers:[{type:'customJwt',applicationID:'pendingtimecare',issuer:'http://pendingtimecare.local',algorithm:'RS256',jwks:`data:text/plain;charset=utf-8;base64,${btoa(JSON.stringify(jwks))}`}]} satisfies AuthConfig;
