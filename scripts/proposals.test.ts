import {it,expect} from 'vitest';
import {fingerprint,validateProposal} from './proposals';
const raw={course:'ECE 150',title:'Assignment 1',estDays:3,source:'learn',dueDates:[{label:'Due',datetime:'2026-11-15T23:59:00-05:00'}]};
it('validates discoveries and gives them stable duplicate identities',()=>{const a=validateProposal(raw),b=validateProposal({...raw,title:' assignment 1 ',dueDates:[{label:'Final',datetime:'2026-11-16T04:59:00Z'}]});expect(a.status).toBe('active');expect(a.steps).toEqual([]);expect(fingerprint(a)).toBe(fingerprint(b));expect(a.dueDates[0].id).toBeTruthy()});
it('rejects uncertain dates, missing course, unsafe estimates and manual writes',()=>{for(const patch of [{course:''},{estDays:0},{estDays:999},{source:'manual'},{dueDates:[]},{dueDates:[{label:'Due',datetime:'2026-11-15T23:59:00'}]}])expect(()=>validateProposal({...raw,...patch})).toThrow()});
