import OfficeTrainingPage from './OfficeTrainingPage';
import { wordCourses } from '../data/officeCourses';

export default function FormationWord() {
  return (
    <OfficeTrainingPage
      tool="Word"
      slug="formation-word"
      heading="Formations Word : Initiation et Perfectionnement"
      lead="Créez des documents professionnels lisibles, puis gagnez en autonomie sur les documents longs, les styles et le publipostage."
      courses={wordCourses}
      compatibility="Les démonstrations utilisent Word pour Microsoft 365. Les besoins liés à une autre version sont vérifiés avant la formation."
    />
  );
}
