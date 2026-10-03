import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',timeout:60000,use:{baseURL:process.env.WEB_URL??'http://localhost:3000',viewport:{width:1280,height:950}},reporter:'list',workers:1});
