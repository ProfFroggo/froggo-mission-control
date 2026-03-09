// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
import { NextResponse } from 'next/server';

const ACCOUNT_TYPES = [
  { id: 'google', label: 'Google', icon: 'google' },
  { id: 'github', label: 'GitHub', icon: 'github' },
  { id: 'notion', label: 'Notion', icon: 'notion' },
  { id: 'linear', label: 'Linear', icon: 'linear' },
];

export async function GET() {
  return NextResponse.json(ACCOUNT_TYPES);
}
