import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { motion } from "framer-motion";

interface ListingCardProps {
  id: string;
  title: string;
  location: string;
  price_per_night: number;
  image_url?: string;
}

const ListingCard = ({ id, title, location, price_per_night, image_url }: ListingCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    whileHover={{ y: -4 }}
    className="group"
  >
    <Link to={`/listing/${id}`} className="block overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-lg">
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {image_url ? (
          <img
            src={`${image_url}?width=648&resize=contain`}
            srcSet={`${image_url}?width=324&resize=contain 324w, ${image_url}?width=648&resize=contain 648w`}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 324px"
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            width={324}
            height={229}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">No image</div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-lg font-semibold leading-tight line-clamp-1">{title}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {location}
        </p>
        <p className="mt-2 text-lg font-bold text-primary">
          ${price_per_night} <span className="text-sm font-normal text-muted-foreground">/ night</span>
        </p>
      </div>
    </Link>
  </motion.div>
);

export default ListingCard;
