import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
const api=vi.hoisted(()=>({role:'admin',user:{id:'admin'},send:vi.fn(),check:vi.fn()}));
vi.mock('../contexts/useAuth',()=>({useAuth:()=>({user:api.user,role:api.role})}));
vi.mock('../lib/supabaseClient',()=>({supabase:{}}));
vi.mock('../lib/clientReply',async(importOriginal)=>({...await importOriginal(),sendClientReply:api.send,checkClientReply:api.check}));
import AdminClientReply from './AdminClientReply';
const request={id:'30000000-0000-4000-8000-000000000001',email:'client@example.test',subject:'Programme détaillé'};
function compose(){fireEvent.click(screen.getByRole('button',{name:'Répondre au client'}));fireEvent.change(screen.getByLabelText('Votre message'),{target:{value:'Voici le programme détaillé.'}});}
function review(){fireEvent.click(screen.getByRole('button',{name:'Vérifier le message et les pièces jointes'}));}
describe('composition intégrée d’une réponse client',()=>{
  beforeEach(()=>{api.role='admin';api.user={id:'admin'};api.send.mockReset().mockResolvedValue({status:'sent'});api.check.mockReset();});
  afterEach(cleanup);
  it('ne déclenche aucun envoi à l’ouverture, exige une vérification puis un clic explicite',async()=>{
    render(<AdminClientReply request={request}/>);compose();
    expect(screen.getByLabelText('Destinataire')).toHaveValue(request.email);
    expect(screen.getByLabelText('Destinataire')).toHaveAttribute('readonly');
    expect(api.send).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Envoyer la réponse au client'})).not.toBeInTheDocument();
    review();expect(api.send).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Envoyer la réponse au client'}));
    await screen.findByRole('status');expect(api.send).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('remise au serveur mail');
  });
  it('sélectionne et retire une PJ et invalide le récapitulatif après modification',()=>{
    render(<AdminClientReply request={request}/>);compose();
    const pdf=new File(['%PDF-1.7\n%%EOF'],'programme.pdf',{type:'application/pdf'});
    fireEvent.change(screen.getByLabelText('Pièces jointes'),{target:{files:[pdf]}});
    expect(screen.getByRole('button',{name:'Retirer programme.pdf'})).toBeVisible();review();
    expect(screen.getByLabelText('Vérification avant envoi')).toHaveTextContent('programme.pdf');
    fireEvent.click(screen.getByRole('button',{name:'Retirer programme.pdf'}));
    expect(screen.queryByLabelText('Vérification avant envoi')).not.toBeInTheDocument();expect(api.send).not.toHaveBeenCalled();
  });
  it('bloque les formats interdits',()=>{
    render(<AdminClientReply request={request}/>);compose();
    fireEvent.change(screen.getByLabelText('Pièces jointes'),{target:{files:[new File(['x'],'programme.exe')]}});
    expect(screen.getByRole('alert')).toHaveTextContent('PDF et DOCX');expect(api.send).not.toHaveBeenCalled();
  });
  it.each(['user','employee',null])('ne présente pas le compositeur au rôle %s',(role)=>{
    api.role=role;const{container}=render(<AdminClientReply request={request}/>);expect(container).toBeEmptyDOMElement();
  });
  it('conserve la clé et vérifie seulement le statut après une erreur réseau',async()=>{
    api.send.mockRejectedValueOnce(new Error('Réseau indisponible'));api.check.mockResolvedValue({status:'sent'});
    render(<AdminClientReply request={request}/>);compose();review();fireEvent.click(screen.getByRole('button',{name:'Envoyer la réponse au client'}));
    await screen.findByRole('alert');expect(screen.getByLabelText('Votre message')).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Vérifier le résultat de cet envoi'}));await screen.findByRole('status');
    expect(api.send).toHaveBeenCalledTimes(1);expect(api.check).toHaveBeenCalledWith(expect.anything(),request.id,api.send.mock.calls[0][4]);
  });
  it('ne renvoie pas un message dont le résultat SMTP est incertain',async()=>{
    api.send.mockResolvedValue({status:'uncertain'});render(<AdminClientReply request={request}/>);compose();review();
    fireEvent.click(screen.getByRole('button',{name:'Envoyer la réponse au client'}));
    await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Aucun renvoi automatique'));
    expect(screen.queryByRole('button',{name:'Réessayer cet envoi'})).not.toBeInTheDocument();expect(api.send).toHaveBeenCalledTimes(1);
  });
});
