import type { Metadata } from "next";
import PretragaPageClient from "./pretraga-ui";

export const metadata: Metadata = {
  title: "Pretraga upravnika zgrada — registar PKS i ocene stanara",
  description:
    "Pretražite sve licencirane profesionalne upravnike zgrada u Srbiji po imenu, mestu i broju licence. Ocene stanara, zgrade kojima upravljaju.",
  alternates: { canonical: "/pretraga" },
  openGraph: { url: "/pretraga" },
};

export default function SearchPage() {
  return <PretragaPageClient />;
}
