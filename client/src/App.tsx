import { Suspense, lazy, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { useShop } from "./lib/shop";
import { Spinner } from "./components/ui";
import { StoreLayout } from "./components/StoreLayout";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Product from "./pages/Product";
import Checkout from "./pages/Checkout";
import Order from "./pages/Order";
import Track from "./pages/Track";
import Page from "./pages/Page";
import LabResults from "./pages/LabResults";
import { BlogList, BlogPost } from "./pages/Blog";
import { Contact, Wholesale } from "./pages/Forms";
import { Compare, Wishlist } from "./pages/Lists";

const AdminApp = lazy(() => import("./admin/AdminApp"));

function ScrollReset() {
  const [path] = useLocation();
  useEffect(() => {
    if (!window.location.hash) window.scrollTo({ top: 0, behavior: "instant" });
  }, [path]);
  return null;
}

const Loading = () => (
  <div className="grid min-h-dvh place-items-center">
    <Spinner />
  </div>
);

export default function App() {
  const shop = useShop();
  const [path] = useLocation();

  if (path.startsWith("/admin")) {
    return (
      <Suspense fallback={<Loading />}>
        <AdminApp />
      </Suspense>
    );
  }
  if (!shop) return <div className="store min-h-dvh" />;

  return (
    <StoreLayout>
      <ScrollReset />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/shop" component={Shop} />
        <Route path="/shop/:slug" component={Shop} />
        <Route path="/product/:slug" component={Product} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/order/:token" component={Order} />
        <Route path="/track" component={Track} />
        <Route path="/lab-results" component={LabResults} />
        <Route path="/blog" component={BlogList} />
        <Route path="/blog/:slug" component={BlogPost} />
        <Route path="/wholesale" component={Wholesale} />
        <Route path="/contact-us" component={Contact} />
        <Route path="/wishlist" component={Wishlist} />
        <Route path="/compare" component={Compare} />
        <Route path="/:slug" component={Page} />
        <Route component={Page} />
      </Switch>
    </StoreLayout>
  );
}
