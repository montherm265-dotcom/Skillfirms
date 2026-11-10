import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Seo from "@/components/seo/Seo";

export default function PageNotFound() {
  return (
    <div className="section-pad relative isolate flex min-h-[70vh] flex-col items-center justify-center overflow-hidden text-center">
      <Seo title="Page not found" noindex canonical="/404" />
      <p aria-hidden className="pointer-events-none absolute top-1/2 -z-10 -translate-y-1/2 select-none text-[11rem] font-extrabold leading-none tracking-[-0.06em] text-[#1f4189]/[0.07] sm:text-[16rem]">404</p>
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">This lesson isn't in the book.</h1>
      <p className="mt-2 text-muted-foreground">The page doesn't exist, or it moved.</p>
      <div className="mt-6 flex gap-3">
        <Link to="/"><Button className="rounded-full px-6">Back home</Button></Link>
        <Link to="/courses"><Button variant="outline" className="rounded-full px-6">Browse courses</Button></Link>
      </div>
    </div>
  );
}
