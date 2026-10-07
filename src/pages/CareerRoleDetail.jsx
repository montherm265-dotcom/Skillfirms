import { useParams } from "react-router-dom";

export default function CareerRoleDetail() {
  const { slug } = useParams();
  return (
    <div className="section-pad">
      <h1 className="font-display text-2xl font-bold">{slug}</h1>
      <p className="mt-2 text-muted-foreground">Lands after the career role graph is built.</p>
    </div>
  );
}
