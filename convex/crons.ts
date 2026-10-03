import {cronJobs} from 'convex/server';
import {internal} from './_generated/api';
const crons=cronJobs();crons.interval('recover expired delivery leases',{seconds:30},internal.workflows.delivery.recover,{});export default crons;
