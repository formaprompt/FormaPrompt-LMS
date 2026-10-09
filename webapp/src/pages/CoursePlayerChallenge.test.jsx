import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CoursePlayer from './CoursePlayer';

const fixture = vi.hoisted(() => ({ denied:false, user:{ id:'fixture-ai-act' } }));
vi.mock('../contexts/useAuth', () => ({ useAuth:() => ({ user:fixture.user }) }));
vi.mock('../data/courseCatalog', () => ({ courseCatalog:{
  'formation-ia-act':{ landingPath:'/presentation-ai-act' },
  'formation-ia':{ landingPath:'/presentation-ia' },
} }));
vi.mock('../lib/paidCourseContent', () => ({ fetchPaidCourseContent:async () => {
  if (fixture.denied) throw Object.assign(new Error('ACCESS_DENIED'),{status:403});
  return { title:'Formation de recette',initialPositioningRequired:false,exercises:[],resources:[],glossary:[] };
} }));
vi.mock('../lib/supabaseClient', () => ({ supabase:{} }));
vi.mock('../components/CourseProgress', () => ({ default:() => <p>Progression pédagogique</p> }));
vi.mock('../components/AiActChallenge', () => ({ default:() => <h2>Jeu pédagogique isolé</h2> }));

function mount(courseId='formation-ia-act') {
  return render(<MemoryRouter initialEntries={[`/course/${courseId}`]}><Routes>
    <Route path="/course/:id" element={<CoursePlayer />} />
    <Route path="/presentation-ai-act" element={<h1>Présentation AI Act</h1>} />
  </Routes></MemoryRouter>);
}
afterEach(cleanup);
beforeEach(() => { fixture.denied=false; });
describe('Challenge intégré au parcours AI Act', () => {
  it('ouvre le jeu depuis les contenus complémentaires après contrôle du droit existant', async () => {
    mount();
    const tab=await screen.findByRole('tab',{name:'AI ACT CHALLENGE'});
    expect(screen.queryByRole('heading',{name:'Jeu pédagogique isolé'})).toBeNull();
    fireEvent.click(tab);
    expect(await screen.findByRole('heading',{name:'Jeu pédagogique isolé'})).toBeVisible();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby','ai-act-challenge-tab');
    expect(screen.getByText('Progression pédagogique')).toBeVisible();
  });
  it('n’ajoute pas le jeu aux autres formations', async () => {
    mount('formation-ia');
    await screen.findByRole('heading',{name:'Formation de recette'});
    expect(screen.queryByRole('tab',{name:'AI ACT CHALLENGE'})).toBeNull();
  });
  it('ne monte jamais le jeu si le lecteur refuse le droit de formation', async () => {
    fixture.denied=true;mount();
    await screen.findByRole('heading',{name:'Présentation AI Act'});
    expect(screen.queryByRole('tab',{name:'AI ACT CHALLENGE'})).toBeNull();
    expect(screen.queryByRole('heading',{name:'Jeu pédagogique isolé'})).toBeNull();
  });
});
