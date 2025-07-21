// Simple debug script to test job parser
import { JobParser } from './src/parsers/job-parser.js';

const mockSource = {
  site: 'test-site',
  originalUrl: 'https://example.com/job/123',
};

const rawData = {
  title: 'Developer',
  company: 'Small Co',
  location: 'Remote',
  description: 'Code things.',
  url: 'https://example.com/job/456',
};

try {
  const _result = JobParser.parseJob(rawData, mockSource);
} catch (error) {
  console.error('Direct error:', error);
}
