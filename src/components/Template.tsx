import { FullScreen, Progress } from "spectacle";

type TemplateProps = {
  slideNumber: number;
  numberOfSlides: number;
};

export function Template({ slideNumber, numberOfSlides }: TemplateProps) {
  return (
    <div className="template-bar">
      <span>Prezzo</span>
      <span>
        {slideNumber}/{numberOfSlides}
      </span>
      <span>
        <Progress color="#f8f3e7" size={18} /> <FullScreen color="#f8f3e7" size={18} />
      </span>
    </div>
  );
}
