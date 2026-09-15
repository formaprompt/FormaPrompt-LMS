import OfficeTrainingPage from './OfficeTrainingPage';
import { powerpointCourses } from '../data/officeCourses';

export default function FormationPowerPoint() {
  return (
    <OfficeTrainingPage
      tool="PowerPoint"
      slug="formation-powerpoint"
      heading="Formation PowerPoint Initiation"
      lead="Concevez un diaporama structuré, cohérent et lisible, puis préparez sa présentation dans un contexte professionnel ou pédagogique."
      courses={powerpointCourses}
      compatibility="Les démonstrations utilisent PowerPoint pour Microsoft 365. Les fonctions, médias et formats nécessaires sont vérifiés avant la formation."
    />
  );
}
