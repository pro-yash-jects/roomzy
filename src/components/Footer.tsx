import { Home } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t bg-secondary/30 py-10">
    <div className="container mx-auto px-4">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2 mb-3">
            <Home className="h-5 w-5 text-primary" />
            <span className="font-display text-lg font-bold">Roomzy</span>
          </Link>
          <p className="text-sm text-muted-foreground">Find your perfect stay, anywhere in the world.</p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Explore</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/" className="hover:text-primary transition-colors">Browse Listings</Link></li>
            <li><Link to="/register" className="hover:text-primary transition-colors">Become a Host</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Support</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><span className="cursor-default">Help Center</span></li>
            <li><span className="cursor-default">Safety</span></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><span className="cursor-default">Privacy Policy</span></li>
            <li><span className="cursor-default">Terms of Service</span></li>
          </ul>
        </div>
      </div>
      <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Roomzy. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
